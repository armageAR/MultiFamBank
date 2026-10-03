<?php

namespace App\Mail;

use App\Models\AccessRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Tells the owner that someone asked for access from the landing page. */
class AccessRequestReceivedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public AccessRequest $accessRequest) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Nueva solicitud de acceso a FamBank: {$this->accessRequest->name}",
            replyTo: [new Address($this->accessRequest->email, $this->accessRequest->name)],
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.access-request-received', with: [
            'name' => $this->accessRequest->name,
            'email' => $this->accessRequest->email,
            'receivedAt' => $this->accessRequest->created_at->timezone('America/Argentina/Buenos_Aires')->format('d/m/Y H:i'),
        ]);
    }
}
