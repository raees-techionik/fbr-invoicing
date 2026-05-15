import React from "react";

export function getFbrErrorsFromApiResponse(payload) {
  const data = payload?.data || payload;
  const candidates = [
    data?.errors,
    data?.data?.errors,
    data?.headerErrors,
    data?.data?.headerErrors,
    data?.mappedErrors,
    data?.data?.mappedErrors,
    data?.fbrRawResponse?.mappedErrors,
    data?.fbr_raw_response?.mappedErrors,
    data?.normalizedInvoice?.fbrRawResponse?.mappedErrors,
    data?.normalizedInvoice?.fbr_raw_response?.mappedErrors,
    data?.dashboardRecord?.fbrRawResponse?.mappedErrors,
    data?.dashboardRecord?.fbr_raw_response?.mappedErrors,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(Boolean);
    }
  }

  return [];
}

function FbrErrorDisplay({ errors = [], compact = false }) {
  if (!errors.length) {
    return null;
  }

  return (
    <div className={`alert alert-danger ${compact ? "py-2 my-2" : ""}`}>
      {!compact && <strong>FBR validation failed</strong>}
      <ul className="mb-0 mt-1">
        {errors.map((error, index) => (
          <li key={`${error.errorCode || "error"}-${error.itemIndex ?? "header"}-${index}`}>
            {error.itemIndex !== undefined && `Item ${error.itemIndex + 1}: `}
            {error.userMessage || error.message || error.fbrMessage || "Review this field and retry."}
            {error.field && error.field !== "invoice" ? ` Field: ${error.field}.` : ""}
            {error.errorCode ? ` Code: ${error.errorCode}.` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FbrErrorDisplay;
