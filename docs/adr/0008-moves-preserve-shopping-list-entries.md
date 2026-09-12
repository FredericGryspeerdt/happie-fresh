# Moves preserve shopping list entries

Moving entries preserves their identity, quantity, notes, and checked state,
even when the destination already contains the same catalogue item. We keep
separate entries rather than merging quantities: different notes and in-cart
states have meaning, and merging would make lossless undo ambiguous. Undo moves
the entries back only if they have not changed since the move; a newly created
destination remains, even when undo empties it.
