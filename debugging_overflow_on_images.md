# Introduction

Starting with Chrome 107, the following elements respect the `overflow` property: img, video and canvas. In earlier versions of Chrome, this property was ignored on these elements.

This means that an image which was earlier clipped to its content box can now draw outside those bounds if specified to do so in a style sheet. The default browser style sheet applies the following default style to these elements:

```css
img {
  overflow: clip;
  overflow-clip-margin: content-box;
}
```

Examples of CSS in a developer stylesheet which can override this behaviour are:

```css
img {
  /* object-fit causes the image to scale and fill the complete box.
     If the aspect ratio is different, the image will draw outside. */
  object-fit: cover;
  overflow: visible;
}
```


```css
img {
  /* border-radius should cause the image to draw as a circle.
     But because 'overflow' is set to visible, it is no longer clipped. */
  border-radius: 50% 50%;
  overflow: visible;
}
```

# Solution

If overriding the `overflow` property to `visible` is not intentional, inspect the CSS applied to the element via [devtools](https://developer.chrome.com/docs/devtools/css/#view). This should allow you to identify the CSS declaration which is overriding the `overflow` property to `visible` and update it to `clip` via an additional style sheet rule such as `#myImage { overflow:clip; }`. Note that another common pattern that can inadvertently cause `overflow` to be `visible` is:

```css
img {
/* This inherits all CSS values including `overflow` */
all: inherit;
}
```

If updating the CSS is not trivial, another fix is to add the following inline style to the element.

```html
<img style="overflow:clip !important"></img>
```
