/**
 * The room's light, as three facts on <html>, set before the first paint:
 * - data-time: day or night at the visitor's place (by their clock). The page palette follows it.
 * - data-lamp: the desk lamp, on or off. The switch flips only this.
 * - data-theme: which render shows, day or lamp. The lamp render is night with the lamp on.
 */
export type Time = 'day' | 'night';
export type Lamp = 'on' | 'off';
export type Render = 'day' | 'lamp';

/** A lamp switched this visit (sessionStorage), so a choice made at noon never darkens a later night. */
export const LAMP_STORAGE_KEY = 'desk-lamp';
/** The old forever-saved theme (localStorage), dropped on load. */
export const OLD_THEME_KEY = 'desk-theme';

export const renderFor = (time: Time, lamp: Lamp): Render =>
  time === 'night' && lamp === 'on' ? 'lamp' : 'day';

export const defaultLamp = (time: Time): Lamp => (time === 'night' ? 'on' : 'off');

/**
 * Runs inline in <head> before first paint. Never throws.
 *
 * Day or night without the network: sunrise and sunset at 40° latitude (south of the equator when
 * the zone's daylight saving falls in January), from the day of the year, in local standard time,
 * an hour later while daylight saving is on. A zone with no daylight saving can't tell its
 * hemisphere and is mostly tropical: it takes the equator's twelve hours. A `?time=day|twilight|night` in the address wins
 * (twilight counts as day). The exact sun, from the visitor's time zone, moves the window later
 * but never changes these.
 */
export const LIGHT_SCRIPT = `(function(){var d=document.documentElement,q='',t,l,m;try{q=location.search}catch(e){}m=/[?&]time=(day|twilight|night)(?:&|$)/.exec(q);if(m){t=m[1]==='night'?'night':'day'}else{try{var n=new Date(),y=n.getFullYear(),j=new Date(y,0,1).getTimezoneOffset(),u=new Date(y,6,1).getTimezoneOffset(),s=Math.max(j,u),z=n.getTimezoneOffset()<s?1:0,r=Math.PI/180,f=(j===u?0:j<u?-40:40)*r,N=[0,31,59,90,120,151,181,212,243,273,304,334][n.getMonth()]+n.getDate(),c=-Math.tan(f)*Math.tan(23.44*r*Math.sin(2*Math.PI*(284+N)/365)),h=Math.acos(Math.max(-1,Math.min(1,c)))*12/Math.PI,x=n.getHours()+n.getMinutes()/60-z;t=x>=12-h&&x<12+h?'day':'night'}catch(e){t='day'}}try{l=sessionStorage.getItem('${LAMP_STORAGE_KEY}')}catch(e){}if(l!=='on'&&l!=='off')l=t==='night'?'on':'off';try{localStorage.removeItem('${OLD_THEME_KEY}')}catch(e){}d.dataset.time=t;d.dataset.lamp=l;d.dataset.theme=t==='night'&&l==='on'?'lamp':'day'})();`;
