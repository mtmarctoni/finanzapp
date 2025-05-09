// import { withAuth } from "next-auth/middleware";

// export default withAuth(
//     {
//   callbacks: {
//     authorized: ({ token }) => !!token,
//   },
// }, {
//   callbacks: {
//     async authorized() {
//       return true;
//     },
//   },
// }
// );

export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/edit/:path",
    "/new",
    "/recurring",
    "/api/:path*",
  ],
};