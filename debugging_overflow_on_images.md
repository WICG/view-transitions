# Introduction

Starting with Chrome 106, the `overflow` property is applied on the following elements: img, video and canvas. In earlier versions of Chrome, this property was ignored on these elements.

This implies that an image which was earlier clipped to its content box can now draw outside those bounds. Common examples of CSS which can result in this are:

```css
img {
  /* object-fit causes the image to scale and fill the complete box.
     If the aspect ratio is different, the image will draw outside. */
  object-fit: cover;
  overflow: visible;
}
```

For example, if your page has the following CSS:

```css
img {
  /* border-radius should cause the image to draw as a circle.
     But because 'overflow' is set to visible, it is no longer clipped. */
  border-radius: 50% 50%;
  overflow: visible;
}
```

# Solution

If overridng the `overflow` property to `visible` is not intentional, inspect the CSS applied to the element via [devtools](https://developer.chrome.com/docs/devtools/css/#view). This should allow you to identify the CSS declaration whih is overriding the `overflow` property to `visible` and update it. Note that another common pattern that can update the `overflow` property is:

```css
img {
/* This inherits all CSS values including `overflow` */
all: inherit;
}
```

If updating the CSS is not trivial, a trivial fix can be to add the following inline style to the element.

```html
<img style="overflow:clip !important"></img>
```
