import * as fs from "fs";
import * as path from "path";
import * as chalk from "chalk";
import { Simple } from "../../types";
import bootstrapProgram from "../bootstrap-program";

void bootstrapProgram(async ({ browser, page }) => {
  if (!browser || !page) return;

  const transactions: Simple.Transaction[] = [];

  console.log("Recoding transactions…");
  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (url.includes("/transactions-gather")) {
      const response = request.response();
      if (response?.ok()) {
        const moreTransactions = (await response.json()) as Simple.Transaction[];
        transactions.push(...moreTransactions);
        console.log(
          `Total transactions recorded: ${chalk.greenBright(
            transactions.length
          )}`
        );
      }
    }
  });

  console.log("Filtering activity by all time…");
  await page.click(".filter-expand");
  await page.select(".time-span-options > select", "all");
  await page.waitForSelector("main.-loading", { hidden: true });
  await page.waitForTimeout(1000); // Additionl wait time

  let numberOfPagingArrows;
  console.log("Visiting all pages to collect transactions…");

  /* eslint-disable no-await-in-loop */
  do {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click(".transactions-paging li:last-of-type"),
    ]);

    await page.waitForSelector("main.-loading", { hidden: true });
    await page.waitForTimeout(1000); // Additionl wait time

    await page.waitForSelector(".transactions-paging .paging-arrow", {
      visible: true,
    });

    numberOfPagingArrows = await page.$$eval(
      ".transactions-paging .paging-arrow",
      (pagingArrows) => pagingArrows.length
    );
  } while (numberOfPagingArrows !== 1);
  /* eslint-enable no-await-in-loop */

  const data = `
import {Simple} from '../../types';

// prettier-ignore
const transactions: Simple.Transaction[] =
	${JSON.stringify(transactions)};

export default transactions;
`;

  const filename = path.join(__dirname, "../config/simple-transactions.ts");
  await fs.promises.writeFile(filename, data, "utf8");

  await page.goto("https://bank.simple.com/signout", {
    waitUntil: "networkidle0",
  });

  await browser.close();
});
