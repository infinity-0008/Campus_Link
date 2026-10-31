import { QueryClient } from "@tanstack/react-query";
const noRetry=[400,401,403,404,409,422];
export const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,refetchOnWindowFocus:false,retry:(count,error)=>!noRetry.includes(error?.status)&&count<2},mutations:{retry:false}}});
