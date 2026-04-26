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

export { default as proxy } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/edit/:path",
    "/new",
    "/recurring",
    "/api/ai/:path*",
    "/api/analytics",
    "/api/api-keys/:path*",
    "/api/crypto/:path*",
    "/api/entries/:path*",
    "/api/export",
    "/api/options",
    "/api/recurring/:path*",
    "/api/stats",
    "/api/summary",
  ],
};
