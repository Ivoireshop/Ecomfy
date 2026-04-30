export const openPaymentWindow = () => {
  const paymentWindow = window.open("", "_blank");

  if (paymentWindow) {
    paymentWindow.opener = null;
    paymentWindow.document.title = "Paiement sécurisé";
    paymentWindow.document.body.innerHTML = "<p style='font-family: system-ui, sans-serif; padding: 24px;'>Ouverture du paiement sécurisé...</p>";
  }

  return paymentWindow;
};

export const redirectToPaymentUrl = (paymentUrl: string, paymentWindow?: Window | null) => {
  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.location.href = paymentUrl;
    return;
  }

  const opened = window.open(paymentUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(paymentUrl);
  }
};

export const closePaymentWindow = (paymentWindow?: Window | null) => {
  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.close();
  }
};