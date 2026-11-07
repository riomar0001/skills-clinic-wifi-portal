"""Errors raised by services. Their messages are written for admins and are safe to show."""


class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidInput(DomainError):
    status_code = 400


class NotAuthenticated(DomainError):
    status_code = 401


class Forbidden(DomainError):
    status_code = 403


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class TooManyAttempts(DomainError):
    status_code = 429
