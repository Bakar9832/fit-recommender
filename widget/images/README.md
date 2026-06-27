# Storefront product images

Drop product photos here for the demo storefront (`widget/storefront.html`).

## Naming

One JPEG per product, named after its `imageSlug` (from the seed / catalog API):

```
images/{imageSlug}.jpg
```

Current demo catalog slugs:

| imageSlug             | product                         |
|-----------------------|---------------------------------|
| lawn-two-piece-01     | Everyday Lawn Two-Piece         |
| lawn-kurti-02         | Embroidered Lawn Kurti          |
| lawn-2pc-03           | Printed Lawn Two-Piece          |
| cotton-kurti-04       | Cotton Daily Kurti              |
| formal-frock-05       | Formal Chiffon Frock            |
| formal-2pc-06         | Formal Embellished Two-Piece    |
| anarkali-07           | Festive Anarkali                |
| lawn-angrakha-08      | Lawn Angrakha Kurti             |

## Sourcing

Use **free-licensed** photos only (e.g. [Unsplash](https://unsplash.com) or
[Pexels](https://pexels.com) — both allow free commercial use, no attribution
required). Save each as `{imageSlug}.jpg`. A 3:4 portrait crop looks best in the grid.

## Fallback

If an image file is absent, the storefront renders a clean placeholder card
(a fabric-coloured block + the product name) instead — so the page works with
zero images. No real photos are committed to the repo.
