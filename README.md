# Come Through

An [Obsidian](https://obsidian.md) plugin for creating and reviewing flashcards by means of the FSRS algorithm.

## Creating Cards

Each note can contain one or more cards. The contents of a side of a certain card is confined within the heading section that has declared the side. Card sides are declared using a Markdown code block with `ct` or `comethrough` as the “language”.

A front is declared like this:

````markdown
```ct
side: front
```
````

Which will render:

> ID: 1745575690288  
> Side: Front

The `ID` is automatically generated (unless you specify your own after  `id:`) and is used to pair the front of a specific card with its back side. For example, to pair a back side to the front above, add the following to another heading section (that isn’t under the previous heading):

````markdown
```ct
id: 1745575690288
side: back
```
````

- The `id` should not be changed (once you rate the card for the first time) or it will be treated as a new card.

The `id` of this type of card (the default type) must be unique across the vault, which allows for declaring one side of a certain card in one note each. The following note, for example, contains three sides: one complete card and one front side.

````markdown
# Note 1

Text here is not part of a card.

## Question Card 1

```ct
side: front
id: card1
```

Contents of the front of `card1`.

## Section without a card

Text here is not part of a card.

## Answer Card 1

```ct
side: back
id: card1
```

Contents of the back of `card1`.

### This section is included

Since this section belongs to the same section that declares the back of `card`, it is also included as part of the back of `card1`.

## Question Card 2

```ct
side: front
id: card2
```

Contents of the front of `card2`.
````

The back side to card 2 is declared in another file:

````markdown
# Note 2

## Section

### Answer Card 2

```ct
side: back
id: card2
```
````

> [!NOTE]
>
> The card declaration format is plain YAML (same as Obsidian [properties](https://help.obsidian.md/properties#Property+format)) so the YAML specification has to be adhered to. For example, there must be a space between the colon and the value.

## Decks

To create decks, select *Decks* in the [Command palette](https://help.obsidian.md/plugins/command-palette).

## Reviewing

To review the cards, click / tap on *Review* in the [ribbon](https://help.obsidian.md/ribbon) or the [Command palette](https://help.obsidian.md/plugins/command-palette).

## Roadmap

- Quicker way to create cards.
- Review sort order options.
- A card can belong to more than one deck.
- A deck can be a subdeck of more than one deck.
- Reverse cards.













