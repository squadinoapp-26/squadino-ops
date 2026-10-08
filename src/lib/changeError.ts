// A problem the person can read and act on (a bad value, Stripe saying no, a signup that was already
// reviewed, ...). Kept in its own file so the modules that make changes can share it without importing each other.
export class ChangeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
