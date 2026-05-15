import { render, screen } from "@testing-library/react";
import FbrErrorDisplay, { getFbrErrorsFromApiResponse } from "./FbrErrorDisplay";

const mockedFailedSubmitResponse = {
  data: {
    isValid: false,
    errors: [
      {
        scope: "item",
        itemIndex: 0,
        errorCode: "0052",
        field: "hsCode",
        userMessage: "HS Code does not match the selected sale type. Review the HS code and sale type.",
        fbrMessage: "Mock item-level validation error.",
      },
    ],
    normalizedInvoice: {
      status: "FAILED",
      fbrRawResponse: {
        timestamp: "2026-05-08T00:00:00.000Z",
        operation: "submit",
        statusCode: "01",
        mappedErrorCode: "0052",
        mappedErrors: [
          {
            scope: "item",
            itemIndex: 0,
            errorCode: "0052",
            field: "hsCode",
            userMessage: "HS Code does not match the selected sale type. Review the HS code and sale type.",
            fbrMessage: "Mock item-level validation error.",
          },
        ],
        invoiceSnapshot: {
          invoiceRefNo: "FAIL-LOCAL-MOCK",
        },
        rawResponse: {
          validationResponse: {
            statusCode: "01",
          },
        },
      },
    },
  },
};

test("extracts mapped FBR errors from mocked failed invoice submit response", () => {
  const errors = getFbrErrorsFromApiResponse(mockedFailedSubmitResponse);

  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({
    scope: "item",
    itemIndex: 0,
    errorCode: "0052",
    field: "hsCode",
  });
});

test("renders frontend FBR error display with item, field, and code", () => {
  const errors = getFbrErrorsFromApiResponse(mockedFailedSubmitResponse);

  render(<FbrErrorDisplay errors={errors} />);

  expect(screen.getByText(/FBR validation failed/i)).toBeInTheDocument();
  expect(screen.getByText(/Item 1:/i)).toBeInTheDocument();
  expect(screen.getByText(/HS Code does not match/i)).toBeInTheDocument();
  expect(screen.getByText(/Field: hsCode/i)).toBeInTheDocument();
  expect(screen.getByText(/Code: 0052/i)).toBeInTheDocument();
});

