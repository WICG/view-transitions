This short review is for the following spec: [Spec_name](url_of_the_spec).

1. [ ] _If the spec (or its implementation) contains any natural language text that will be read by a human (this includes error messages or other UI text, JSON strings, etc, etc),_ **ensure that there’s metadata about and support for basic things such as language and text direction**.  Also check the detailed guidance for [Language](https://www.w3.org/TR/international-specs/#resource) and [Text direction](https://www.w3.org/TR/international-specs/#text_direction).

    Comments_go_here.
    - [x] Not applicable
    
2. [ ] _If the spec (or its implementation) allows content authors to produce typographically appealing text, either in its own right, or in association with graphics._ **take into account the different typographic styles used around the world (for things such as line-breaking, text justification, emphasis or other text decorations, text selection and units, etc.)**  Also check the detailed guidance for [Typographic support](https://www.w3.org/TR/international-specs/#typography).

    Comments_go_here.
    - [x] Not applicable

3. [ ] _If the spec (or its implementation) allows the user to point into text, creates text fragments, concatenates text, allows the user to select or step through text (using a cursor or other methods), etc._ **make allowances for the ways different scripts handle units of text**.  Also check the detailed guidance for [Text-processing](https://www.w3.org/TR/international-specs/#operations).

    Comments_go_here.
    - [x] Not applicable

4. [ ] _If the spec (or its implementation) allows searching or matching of text, including syntax and identifiers_ **understand the implications of normalisation, case folding, etc**.  Also check the detailed guidance for [Text-processing](https://www.w3.org/TR/international-specs/#operations).

    Comments_go_here
    - [x] Not applicable

5. [ ] _If the spec (or its implementation) sorts text_ **ensure that it does so in locally relevant ways**. Also check the detailed guidance for [Text-processing](https://www.w3.org/TR/international-specs/#operations).

    Comments go here.
    - [ ] Not applicable

6. [ ] _If the spec (or its implementation) captures user input_ **ensure that it also captures metadata about language and text direction, and that it accommodates locale-specific input methods**. 

    Comments go here.
    - [x] Not applicable

7. [ ] _If the spec (or its implementation) deals with time in any way that will be read by humans and/or crosses time zone boundaries_  **ensure that it will represent time as expected in locales around the world, and manage the relationship between local and global/absolute time**. Also check the detailed guidance for [Local dates, times and formats](https://www.w3.org/TR/international-specs/#locale).

    Comments go here.
    - [x] Not applicable

8. [ ] _If the spec (or its implementation) allows any character encoding other than UTF-8._  **make sure you have a convincing argument as to why, and then ensure that the character encoding model is correct**.   Also check the detailed guidance for [Characters](https://www.w3.org/TR/international-specs/#characters).

    Comments go here.
    - [x] Not applicable

9. [ ] _If the spec (or its implementation) defines markup_  **ensure support for internationalisation features and avoid putting human-readable text in attribute values or plain-text elements**.  Also check the detailed guidance for [Markup & syntax](https://www.w3.org/TR/international-specs/#markup).

    Comments go here.
    - [x] Not applicable

10. [ ] _If the spec (or its implementation) deals with names, addresses, time & date formats, etc_  **ensure that the model is flexible enough to cope with wide variations in format, levels of data, etc**.   Also check the detailed guidance for [Local dates, times and formats](https://www.w3.org/TR/international-specs/#locale).

    Comments go here.
    - [x] Not applicable

11. [ ] _If the spec (or its implementation) describes a format or data that is likely to need localization._  **ensure that there’s an approach in place which allows effective storage and labelling of, and access to localised alternatives for strings, text, images, etc**.  

    Comments go here.
    - [x] Not applicable

12. [ ] _If the spec (or its implementation) makes any reference to or relies on any cultural norms_  **ensure that it can be adapted to suit different cultural norms around the world (ranging from depictions of people or gestures, to expectations about gender roles, to approaches to work and life, etc)**.

    Comments go here.
    - [x] Not applicable

Short i18n review checklist is [here](https://www.w3.org/International/i18n-drafts/techniques/shortchecklist.html)
