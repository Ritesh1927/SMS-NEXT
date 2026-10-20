// Inline <script> rendered in the root layout <head>: redirects signed-in
// users and installed-app launches away from the homepage ("/") before first
// paint. It lives in the layout (server-rendered once, never re-created on the
// client) because React warns about <script> tags rendered by pages, and
// next/script "beforeInteractive" only runs after the Next runtime loads,
// which would flash the landing page. Kept in a plain module (not "use client")
// so the server component receives the string. Mirrors HomeRedirect.tsx,
// which covers client-side navigations.
export const HOME_REDIRECT_SCRIPT = `(function(){try{
if(location.pathname!=="/")return;
var s=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
var t=localStorage.getItem('sms_next_user')?'/dashboard':localStorage.getItem('sms_next_superadmin_token')?'/super-admin':s?'/login':null;
if(t){document.documentElement.style.visibility='hidden';location.replace(t);}
}catch(e){}})();`;
