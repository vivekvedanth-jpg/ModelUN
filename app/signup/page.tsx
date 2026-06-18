import { redirect } from "next/navigation";

/**
 * Public sign-up has been removed. Accounts are created by administrators only,
 * so any visit to /signup is sent straight to the sign-in page. There is no
 * registration form or endpoint anywhere in the app.
 */
export default function SignUpPage() {
  redirect("/signin");
}
