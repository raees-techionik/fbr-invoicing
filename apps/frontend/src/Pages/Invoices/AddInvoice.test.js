import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AddInvoice from "./AddInvoice";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { submitInvoice } from "../../services/fbrInvoiceApi";
import { enqueueOfflineInvoice } from "../../services/fbrOfflineQueueApi";
import { getFbrReferenceBootstrap } from "../../services/fbrReferenceApi";
import { getProductMappings, resolveHsInvoiceFields } from "../../services/fbrProductMappingsApi";
import { getSandboxScenarios } from "../../services/fbrSandboxApi";
import { getCustomers } from "../../services/customersApi";
import { getCompanyProfile } from "../../services/companyProfileApi";

jest.mock("../../Components/useBlockBackButton", () => jest.fn());

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}), { virtual: true });

jest.mock("../../hooks/useOnlineStatus", () => ({
  useOnlineStatus: jest.fn(),
}));

jest.mock("../../services/fbrInvoiceApi", () => ({
  submitInvoice: jest.fn(),
}));

jest.mock("../../services/fbrOfflineQueueApi", () => ({
  enqueueOfflineInvoice: jest.fn(),
}));

jest.mock("../../services/fbrReferenceApi", () => ({
  getFbrReferenceBootstrap: jest.fn(),
}));

jest.mock("../../services/fbrProductMappingsApi", () => ({
  getProductMappings: jest.fn(),
  resolveHsInvoiceFields: jest.fn(),
}));

jest.mock("../../services/fbrSandboxApi", () => ({
  getSandboxScenarios: jest.fn(),
}));

jest.mock("../../services/customersApi", () => ({
  getCustomers: jest.fn(),
}));

jest.mock("../../services/companyProfileApi", () => ({
  getCompanyProfile: jest.fn(),
}));

jest.mock("../../utils/generateInvoicePdf", () => ({
  generateInvoicePdfFromForm: jest.fn(),
}));

jest.mock("file-saver", () => ({
  saveAs: jest.fn(),
}));

function changeNamed(container, selector, value) {
  const input = container.querySelector(selector);
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { name: input.name, value } });
}

beforeEach(() => {
  jest.clearAllMocks();
  useOnlineStatus.mockReturnValue({ isOnline: false });
  enqueueOfflineInvoice.mockResolvedValue({ id: "queued-id", status: "PENDING" });
  submitInvoice.mockResolvedValue({ isValid: true });
  getProductMappings.mockResolvedValue([]);
  getSandboxScenarios.mockResolvedValue([]);
  getCustomers.mockResolvedValue([]);
  getCompanyProfile.mockResolvedValue(null);
  resolveHsInvoiceFields.mockResolvedValue({});
  getFbrReferenceBootstrap.mockResolvedValue({
    provinces: {
      data: [
        { description: "Punjab" },
        { description: "Sindh" },
      ],
    },
    documentTypes: { data: [{ description: "Sale Invoice" }] },
    itemDescriptions: { data: [] },
    uoms: { data: [] },
    sroItemCodes: { data: [] },
    transactionTypes: { data: [] },
  });
});

test("queues invoice creation when browser is offline", async () => {
  const { container } = render(<AddInvoice />);

  await screen.findByRole("button", { name: /submit invoice/i });

  changeNamed(container, 'input[name="invoiceDate"]', "2026-05-08");
  changeNamed(container, 'input[name="sellerNTNCNIC"]', "1234567890123");
  changeNamed(container, 'input[name="sellerBusinessName"]', "Codex Seller");
  changeNamed(container, 'select[name="sellerProvince"]', "Punjab");
  changeNamed(container, 'input[name="sellerAddress"]', "Test seller address");
  changeNamed(container, 'input[name="buyerNTNCNIC"]', "9876543210987");
  changeNamed(container, 'input[name="buyerBusinessName"]', "Codex Buyer");
  changeNamed(container, 'select[name="buyerProvince"]', "Sindh");
  changeNamed(container, 'input[name="buyerAddress"]', "Test buyer address");

  fireEvent.click(screen.getByRole("button", { name: /submit invoice/i }));

  await waitFor(() => {
    expect(enqueueOfflineInvoice).toHaveBeenCalledTimes(1);
  });

  expect(submitInvoice).not.toHaveBeenCalled();
  expect(enqueueOfflineInvoice).toHaveBeenCalledWith(
    expect.objectContaining({
      invoicePayload: expect.objectContaining({
        invoiceType: "Sale Invoice",
        invoiceDate: "2026-05-08",
        sellerNTNCNIC: "1234567890123",
        sellerBusinessName: "Codex Seller",
        sellerProvince: "Punjab",
        buyerNTNCNIC: "9876543210987",
        buyerBusinessName: "Codex Buyer",
        buyerProvince: "Sindh",
        buyerRegistrationType: "Registered",
        items: expect.any(Array),
      }),
      settings: {
        environment: "sandbox",
      },
    }),
  );
  expect(await screen.findByText(/You are offline\. Invoice has been saved to the offline queue/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /view offline queue/i })).toHaveAttribute("href", "/invoice/offline-queue");
});
