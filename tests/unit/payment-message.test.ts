import { expect, test } from "@playwright/test";
import { parsePaymentMessage } from "@/lib/payment-message";
import { parseSharedText } from "@/lib/quick-entry";

const TODAY = "2026-10-03";

// Shapes of real bank SMS and UPI app messages (numbers and names changed).
const MESSAGES: { name: string; text: string; amount: number; merchant: string; date?: string }[] = [
  {
    name: "HDFC UPI (multi-line)",
    text: "Sent Rs.450.00\nFrom HDFC Bank A/C *1234\nTo ZOMATO\nOn 02/10/26\nRef 627612345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
    amount: 450,
    merchant: "Zomato",
    date: "2026-10-02",
  },
  {
    name: "HDFC UPI to a VPA",
    text: "Rs.120.00 debited from a/c **1234 on 03-10-26 to VPA swiggy@icici (UPI Ref No 627600000000). Not you? Call on 18002586161 to report",
    amount: 120,
    merchant: "Swiggy",
    date: "2026-10-03",
  },
  {
    name: "SBI UPI",
    text: "Dear UPI user A/C X1234 debited by 250.0 on date 01Oct26 trf to UBER INDIA Refno 427612345678. If not u? call 1800111109. -SBI",
    amount: 250,
    merchant: "Uber India",
    date: "2026-10-01",
  },
  {
    name: "ICICI card",
    text: "INR 1,299.00 spent using ICICI Bank Card XX4321 on 03-Oct-26 on AMAZON PAY IN. Avl Limit: INR 2,34,567.89. If not you, call 1800 2662/SMS BLOCK 4321 to 9215676766.",
    amount: 1299,
    merchant: "Amazon Pay In",
    date: "2026-10-03",
  },
  {
    name: "Axis UPI (P2M line)",
    text: "INR 560.00 debited\nA/c no. XX1234\n03-10-26, 14:22:10\nUPI/P2M/627612345678/BLINKIT\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank",
    amount: 560,
    merchant: "Blinkit",
    date: "2026-10-03",
  },
  {
    name: "Kotak UPI to a VPA with dots",
    text: "Sent Rs.80.00 from Kotak Bank AC X1234 to metro.recharge@paytm on 03-10-26.UPI Ref 627612345678. Not you, https://kotak.com/KBANKT/Fraud",
    amount: 80,
    merchant: "Metro Recharge",
  },
  { name: "Google Pay share", text: "You paid ₹45 to Chai Point", amount: 45, merchant: "Chai Point" },
  {
    name: "PhonePe share",
    text: "₹ 1,200 paid to Rajesh Kumar successfully. UPI Ref: 627612345678",
    amount: 1200,
    merchant: "Rajesh Kumar",
  },
  {
    name: "Paytm with a balance after",
    text: "Rs.99 paid to Netflix from Paytm Balance. Updated Balance: Rs.1,234.50",
    amount: 99,
    merchant: "Netflix",
  },
  {
    name: "balance mentioned before the amount",
    text: "Avl Bal Rs 12,345.00. Rs 200.00 debited from A/C XX1234 to VPA rapido@ybl",
    amount: 200,
    merchant: "Rapido",
  },
  {
    name: "merchant QR VPA with no readable name",
    text: "Rs.35.00 debited from a/c **1234 on 03-10-26 to VPA paytmqr2810050501@paytm (UPI Ref No 627600000001)",
    amount: 35,
    merchant: "",
  },
];

test.describe("payment messages", () => {
  for (const m of MESSAGES) {
    test(m.name, () => {
      const parsed = parsePaymentMessage(m.text, TODAY);
      expect(parsed.amount).toBe(m.amount);
      expect(parsed.merchant).toBe(m.merchant);
      expect(parsed.credit).toBe(false);
      if (m.date) expect(parsed.spentOn).toBe(m.date);
    });
  }

  test("money received is recognised as a credit", () => {
    const parsed = parsePaymentMessage(
      "Rs.5,000.00 credited to a/c XX1234 on 03-10-26 by a/c linked to VPA rahul@okaxis (UPI Ref No 627612345678).",
      TODAY,
    );
    expect(parsed.amount).toBe(5000);
    expect(parsed.credit).toBe(true);
  });

  test("dates in the future or months ago are ignored", () => {
    expect(parsePaymentMessage("Rs 50 debited on 05-10-26 to VPA x@ybl", TODAY).spentOn).toBeNull();
    expect(parsePaymentMessage("Rs 50 debited on 03-01-26 to VPA x@ybl", TODAY).spentOn).toBeNull();
  });

  test("text that isn't a payment has no amount", () => {
    expect(parsePaymentMessage("Your OTP is 123456. Do not share it.", TODAY).amount).toBeNull();
  });

  test("shared text becomes a draft: category from the merchant, UPI as the method", () => {
    const draft = parseSharedText(MESSAGES[2].text, {
      today: TODAY,
      categories: [
        { id: "food", name: "Food & Drinks" },
        { id: "transport", name: "Transport" },
      ],
      paymentMethods: [
        { id: "cash", name: "Cash" },
        { id: "upi", name: "UPI / Online" },
      ],
      noteHistory: new Map(),
    });
    expect(draft).toMatchObject({
      amount: 250,
      note: "Uber India",
      categoryId: "transport",
      paymentMethodId: "upi",
      spentOn: "2026-10-01",
    });
  });
});
