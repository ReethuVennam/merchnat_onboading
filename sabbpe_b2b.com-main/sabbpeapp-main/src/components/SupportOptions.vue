<template>
  <div class="support-options">
    <!-- Call Support Option -->
    <div class="support-option">
      <a href="tel:18001234567" class="call-support">Call Support</a>
    </div>
    <!-- Email Support Option -->
    <div class="support-option">
      <a href="mailto:support@sabbpe.com" class="email-support">Email Support</a>
    </div>
    <!-- WhatsApp Support Option -->
    <div class="support-option">
      <a
        :href="whatsappLink"
        target="_blank"
        rel="noopener noreferrer"
        class="whatsapp-support"
      >
        WhatsApp Support
      </a>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    applicationId: String,
    currentStep: String,
    userId: String,
  },
  computed: {
    whatsappLink() {
      const baseUrl = 'https://wa.me/919958750013';
      const message = `Hi SabPe Support,\n\nI need help with merchant onboarding.\n\nApplication ID: ${this.applicationId}\nCurrent Step: ${this.currentStep}\nUser ID: ${this.userId}`;
      return `${baseUrl}?text=${encodeURIComponent(message)}`;
    },
  },
};
</script>