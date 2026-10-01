<?php

namespace App\Mail;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClientInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invitation $invitation, public string $acceptUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Te invitaron a {$this->invitation->bank->name} en MultiFamBank");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.client-invitation', with: [
            'name' => $this->invitation->name,
            'bankName' => $this->invitation->bank->name,
            'acceptUrl' => $this->acceptUrl,
            'expiresAt' => $this->invitation->expires_at->timezone($this->invitation->bank->timezone)->format('d/m/Y H:i'),
        ]);
    }
}
