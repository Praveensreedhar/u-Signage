export const slideNames={cut:'None',fade:'Fade',slide:'Slide left',zoom:'Zoom in',slideRight:'Slide right',slideUp:'Slide up',slideDown:'Slide down',zoomOut:'Zoom out',wipeLeft:'Wipe left',wipeRight:'Wipe right',wipeUp:'Wipe up',wipeDown:'Wipe down',circle:'Circle reveal',blur:'Blur reveal',flip:'Flip',spin:'Spin in'};
export const slideFrames={
 fade:[{opacity:0},{opacity:1}],slide:[{transform:'translateX(100%)'},{transform:'translateX(0)'}],zoom:[{opacity:0,transform:'scale(1.15)'},{opacity:1,transform:'scale(1)'}],
 slideRight:[{transform:'translateX(-100%)'},{transform:'translateX(0)'}],slideUp:[{transform:'translateY(100%)'},{transform:'translateY(0)'}],slideDown:[{transform:'translateY(-100%)'},{transform:'translateY(0)'}],
 zoomOut:[{opacity:0,transform:'scale(0.7)'},{opacity:1,transform:'scale(1)'}],
 wipeLeft:[{clipPath:'inset(0 0 0 100%)'},{clipPath:'inset(0 0 0 0)'}],wipeRight:[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],wipeUp:[{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0 0 0 0)'}],wipeDown:[{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0 0)'}],
 circle:[{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(150% at 50% 50%)'}],blur:[{opacity:0,filter:'blur(24px)'},{opacity:1,filter:'blur(0px)'}],
 flip:[{opacity:0,transform:'perspective(1000px) rotateY(90deg)'},{opacity:1,transform:'perspective(1000px) rotateY(0deg)'}],spin:[{opacity:0,transform:'rotate(-20deg) scale(0.7)'},{opacity:1,transform:'rotate(0deg) scale(1)'}]
};
export const extraTextNames={right:'Slide from right',down:'Slide down',bounce:'Bounce in',rotate:'Rotate in',blur:'Blur reveal',expand:'Expand'};
export const extraTextFrames={
 right:[{opacity:0,transform:'translateX(100px)'},{opacity:1,transform:'translateX(0)'}],down:[{opacity:0,transform:'translateY(-50px)'},{opacity:1,transform:'translateY(0)'}],
 bounce:[{opacity:0,transform:'scale(0.5)',offset:0},{opacity:1,transform:'scale(1.08)',offset:0.65},{transform:'scale(0.97)',offset:0.85},{transform:'scale(1)',offset:1}],
 rotate:[{opacity:0,transform:'rotate(-12deg) scale(0.8)'},{opacity:1,transform:'rotate(0deg) scale(1)'}],blur:[{opacity:0,filter:'blur(12px)'},{opacity:1,filter:'blur(0px)'}],expand:[{opacity:0,transform:'scaleX(0.2)'},{opacity:1,transform:'scaleX(1)'}]
};
