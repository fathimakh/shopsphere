# RapidMiner output

`processes/product_similarity.rmp` writes **`product_similarity.csv`** here
(`FIRST_ID, SECOND_ID, SIMILARITY`). Import it into the store with **Admin → RapidMiner → Import
RapidMiner output** or `POST /api/analytics/import` (see [../README.md](../README.md)), then commit it as
evidence of the RapidMiner run.

No file is committed here yet: the processes have not been run in Altair AI Studio (see
[../VERIFICATION.md](../VERIFICATION.md)). Nothing in this repository pretends to be RapidMiner output.
