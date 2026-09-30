<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;
use RuntimeException;

/** A business rule violation, rendered as a 422 validation error on the given field. */
class DomainRuleException extends RuntimeException
{
    public function __construct(public readonly string $field, string $message)
    {
        parent::__construct($message);
    }

    public function toValidationException(): ValidationException
    {
        return ValidationException::withMessages([$this->field => $this->getMessage()]);
    }
}
