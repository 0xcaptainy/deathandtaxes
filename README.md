# d/t scanner

chrome extension that shows you the tax status of every Death & Taxes NFT while you browse opensea. no more guessing who paid, who didnt, who is about to get clapped.

## what it does

badges overlay on every NFT card showing you:

- **TAXES PAID** / **UNPAID THIS EPOCH** / **DELINQUENT** with how many epochs behind
- **AUDITED** with live countdown timer
- **KILLABLE** when audit expired (blinking red, cant miss it)
- **INSURED** / **BRIBE** balance

## install (takes 30 seconds)

1. click the green **Code** button at the top of this page
2. click **Download ZIP**
3. unzip the folder somewhere on your computer
4. open chrome and go to `chrome://extensions`
5. turn on **Developer mode** (toggle in the top right corner)
6. click **Load unpacked**
7. select the folder you just unzipped (the one with `manifest.json` inside it)
8. go to the [D&T collection on opensea](https://opensea.io/collection/deathandtaxes)
9. you should see badges on every NFT card

thats it. no terminal, no commands, no coding.

## how it works

extension only activates on the D&T collection page. it does not run on your profile, wallet, other collections, or anywhere else on opensea. you can verify this in `manifest.json`. reads directly from the game contract on eth mainnet through a public api. zero background scanning. only fetches data for the tokens you are actually looking at. badges show up on every card with live status.

## links

- [Death & Taxes](https://www.deptofdeath.xyz/)
- [Collection on OpenSea](https://opensea.io/collection/deathandtaxes)

built by [@whycaptainy](https://x.com/whycaptainy)
