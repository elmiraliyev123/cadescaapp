import { redirect } from "next/navigation";

export default function UserIndex() {
  redirect("/app/user/home");
}
