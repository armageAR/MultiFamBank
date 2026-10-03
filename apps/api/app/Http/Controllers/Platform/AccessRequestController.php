<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\AccessRequest;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** People who asked for access from the public page, for the superadmin to follow up. */
class AccessRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'contacted'])],
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $requests = AccessRequest::query()
            ->when(($data['status'] ?? null) === 'pending', fn ($query) => $query->whereNull('contacted_at'))
            ->when(($data['status'] ?? null) === 'contacted', fn ($query) => $query->whereNotNull('contacted_at'))
            ->when($data['search'] ?? null, function ($query, $search) {
                // "!" escapes LIKE wildcards; a backslash confuses PDO's placeholder parsing on PostgreSQL.
                $term = '%'.preg_replace('/[!%_]/', '!$0', mb_strtolower($search)).'%';
                $query->where(fn ($query) => $query
                    ->whereRaw("lower(name) like ? escape '!'", [$term])
                    ->orWhereRaw("email like ? escape '!'", [$term]));
            })
            ->latest('id')
            ->paginate(25);

        return response()->json([
            'data' => collect($requests->items())->map(fn (AccessRequest $r) => $this->present($r)),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'last_page' => $requests->lastPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
            ],
            'counts' => [
                'pending' => AccessRequest::whereNull('contacted_at')->count(),
                'contacted' => AccessRequest::whereNotNull('contacted_at')->count(),
            ],
        ]);
    }

    public function update(Request $request, AccessRequest $accessRequest): JsonResponse
    {
        $data = $request->validate(['contacted' => ['required', 'boolean']]);
        $before = $accessRequest->contacted_at?->toIso8601String();

        $accessRequest->forceFill(['contacted_at' => $data['contacted'] ? ($accessRequest->contacted_at ?? now()) : null])->save();
        AuditLog::record('access_request.contacted', $accessRequest, null, ['contacted_at' => $before], ['contacted_at' => $accessRequest->contacted_at?->toIso8601String()]);

        return response()->json(['data' => $this->present($accessRequest)]);
    }

    private function present(AccessRequest $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'email' => $r->email,
            'created_at' => $r->created_at?->toIso8601String(),
            'notified_at' => $r->notified_at?->toIso8601String(),
            'contacted_at' => $r->contacted_at?->toIso8601String(),
        ];
    }
}
