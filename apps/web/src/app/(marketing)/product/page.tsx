import { redirect } from "next/navigation";

/** The V3 "Product" page is now "For Advisors & Firms"; keep the old URL working. */
export default function ProductRedirect() {
  redirect("/firms");
}
