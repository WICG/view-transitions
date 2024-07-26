# Explainer: Nested View Transitions
(Still WIP)

## Overview
[view transitions](https://www.w3.org/TR/css-view-transitions-1/) work by generating a pseudo-element tree representing groups of the captured old state & the live new state of a transition.
In its current form, the generated tree is "flat" - the original hierarchy in the DOM is lost, and all the captured groups are siblings under a single `::view-transition` pseudo-element.

This is sufficient for many use cases, but not for all. Some CSS features rely on the nested nature of the DOM tree. To name a few:
* Clipping (`overflow`, `clip-path`, `border-radius`) applies to the whole tree rather than to each element individually.
* 3D (`transform`, `transform-style`, `perspective`, ...): flattening the tree loses the 3D relationship between the elements.
* Masking & effects (`opacity`, `mask-image`, `filter`): these effects change their visual output when applied to each element individually vs. being applied to the tree.

When any of the above features is used, view transitions start to feel constrained. Apart from the fact that not all animation styles are possible,
some animations would look "broken" by default, e.g. elements abruptly lose their clip for the duration of the transition.

## Proposed solution
The solution being worked on is a new property called `view-transition-group`. It creates a semantic where a captured element can preserve or change its tree position during the view transition.
For example, a clipping container can use `view-transition: contain`, and then the pseudo-elements for its descendants with a `view-transition-name` would become part of its generated group.

