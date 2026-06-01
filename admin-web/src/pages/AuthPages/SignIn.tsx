import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Admin Login | Mega Mall Admin"
        description="Mega Mall admin login"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
