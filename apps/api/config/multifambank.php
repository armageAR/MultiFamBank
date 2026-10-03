<?php

return [

    // Public URLs of the frontends, used in email links.
    'urls' => [
        'client' => rtrim((string) env('CLIENT_APP_URL', 'http://localhost:5173'), '/'),
        'admin' => rtrim((string) env('ADMIN_APP_URL', 'http://localhost:5174'), '/'),
        'superadmin' => rtrim((string) env('SUPERADMIN_APP_URL', 'http://localhost:5175'), '/'),
    ],

    // Requests from the public landing page: who is notified and through which mailer. The mailer
    // is separate from MAIL_MAILER so invitations can keep using manual links meanwhile.
    'access_requests' => [
        'notify_to' => env('ACCESS_REQUEST_NOTIFY_EMAIL'),
        'mailer' => env('ACCESS_REQUEST_MAILER', env('MAIL_MAILER', 'log')),
    ],

    'invitation_ttl_days' => (int) env('INVITATION_TTL_DAYS', 7),

    // While email delivery is not configured (MAIL_MAILER=log), the API returns invitation links to
    // the superadmin so they can be shared manually. Never enabled once a real mailer is in use.
    'expose_invitation_links' => env('MAIL_MAILER', 'log') === 'log',

];
