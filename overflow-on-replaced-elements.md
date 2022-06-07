## Overview

The [overflow](https://drafts.csswg.org/css-overflow/#propdef-overflow) CSS property allows an element to paint outside its bounds. This property is currently not supported for replaced elements other than [svg](https://developer.mozilla.org/en-US/docs/Web/SVG). This explainer outlines the motivation and details to support this for all replaced elements.

## Motivation
The primary motivation for this change is [Shared Element Transitions](https://github.com/WICG/shared-element-transitions/blob/main/explainer.md). The feature recreates the visual rendering of a DOM element using a replaced element. The bounding box for the replaced element maps to the DOM element's border-box and the contents are a painted snapshot including the DOM element's layout and ink overflow. Since the snapshot can be larger than the replaced element's bounds, this requires enabling visible overflow on replaced elements.

In addition, replaced elements currently clip to their content-box by default. This [issue](https://github.com/w3c/csswg-drafts/issues/7188) explains a case where the content needs to be clipped to the padding-box.

## Details
The default behaviour for replaced elements for `overflow` and `overflow-clip-margin` diverges from other elements as follows:

* overflow: Initial value is `visible` while replaced elements render as `clip`.
* overflow-clip-margin: Default value for `overflow-clip-edge` is `padding-box` while replaced elements render as `content-box`.

The default behaviour for replaced elements is expressed with the following CSS in the UA stylesheet:

```
overflow: clip;
overflow-clip-margin: content-box;
```

Developers can override these to customize the behaviour as needed. The replaced elements created by Shared Element Transitions use `overflow: visible`.
