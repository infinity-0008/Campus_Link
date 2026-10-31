export function scrollToSection(event, id){
  const target=document.getElementById(id);
  if(target){event?.preventDefault?.();target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}
}
