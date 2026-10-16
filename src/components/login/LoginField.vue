<script setup lang="ts">
/** Label + grey rounded input with an optional trailing slot (e.g. eye toggle). */
defineProps<{
  label: string;
  modelValue: string;
  placeholder: string;
  type?: string;
  autocomplete?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<template>
  <div class="login-field">
    <label class="login-field__label">{{ label }}</label>
    <div class="login-field__box">
      <input
        class="login-field__input"
        :type="type ?? 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.login-field__label {
  display: block;
  margin-bottom: 7px;
  font-size: 0.84375rem;
  font-weight: 600;
  color: var(--c-forest-dark);
}
.login-field__box {
  display: flex;
  align-items: center;
  height: 46px;
  background: var(--c-field-bg);
  border-radius: 6px;
}
.login-field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 16px;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.84375rem;
  color: #000;
}
.login-field__input::placeholder {
  color: rgba(0, 0, 0, 0.43);
}
</style>
