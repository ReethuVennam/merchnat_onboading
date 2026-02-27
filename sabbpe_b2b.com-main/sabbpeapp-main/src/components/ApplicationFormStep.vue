<template>
  <div class="application-form-step">
    <!-- ...existing code... -->
    <div class="help-on-whatsapp" style="margin-top: 2rem;">
      <p style="font-weight: 500; margin-bottom: 0.5rem;">Need Help on WhatsApp?</p>
      <a
        :href="whatsappLink"
        target="_blank"
        rel="noopener noreferrer"
        class="whatsapp-link"
        style="color: #25D366; font-weight: 600;"
      >
        Chat with SabPe Support
      </a>
    </div>
    <!-- ...existing code... -->
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