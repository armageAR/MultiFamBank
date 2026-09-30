<?php

namespace App\Mail;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BankAdminInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invitation $invitation, public string $acceptUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Te invitaron a administrar un banco en MultiFamBank');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.bank-admin-invitation', with: [
            'name' => $this->invitation->name,
            'acceptUrl' => $this->acceptUrl,
            'expiresAt' => $this->invitation->expires_at->timezone('America/Argentina/Buenos_Aires')->format('d/m/Y H:i'),
        ]);
    }
}
