export const generateWhatsAppLink = (sellerPhone, itemTitle, schoolName, lang = 'EN', successNote = null) => {
  // Clean the phone number (assuming India +91 base if not provided)
  const cleanPhone = sellerPhone.replace(/\D/g, '');
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  let text = `Hi! I'm a fellow family from the Vidya Share community. I'd love to pick up the "${itemTitle}" (${schoolName}) you posted!`;
  
  if (successNote) {
    text += ` Also, thank you so much for the tip: "${successNote}" - that's really helpful!`;
  }

  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${finalPhone}?text=${encodedText}`;
};
