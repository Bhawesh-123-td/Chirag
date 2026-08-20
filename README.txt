# Smart Inventory

A standalone browser-based inventory app modeled around the two invoice formats:

- **Pink = Purchase from business** → records quantity and unit cost, calculating expenditure.
- **Yellow = Sale to consumer** → records quantity and selling price, calculating revenue.
- **Inventory** → purchased quantity − sold quantity.
- **Profit** → sales revenue − cost of goods sold.
- Cost of goods sold uses a **weighted-average purchase cost** for each product at the time of sale.
- Data is saved automatically in the browser with `localStorage`.

## Run
Open `index.html` in Chrome, Edge, Firefox, or another modern browser.

No server, database, or internet connection is required.

## Important
This version intentionally keeps the invoice entry simple, as requested. It does not reproduce every field on the paper invoices.
