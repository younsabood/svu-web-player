import Swal from 'sweetalert2';

const isDarkMode = () => document.documentElement.classList.contains('dark');

const buildBaseOptions = () => ({
  background: isDarkMode() ? '#111111' : '#ffffff',
  color: isDarkMode() ? '#f8fafc' : '#0f172a',
  confirmButtonColor: '#ea3323',
  cancelButtonColor: '#64748b',
  reverseButtons: true,
  buttonsStyling: true,
  customClass: {
    popup: 'rounded-[1.75rem]',
    confirmButton: 'swal2-confirm-btn',
    cancelButton: 'swal2-cancel-btn',
  },
});

export const showConfirmDialog = async ({
  title,
  text,
  html,
  icon = 'warning',
  confirmButtonText = 'متابعة',
  cancelButtonText = 'إلغاء',
}) => {
  const result = await Swal.fire({
    ...buildBaseOptions(),
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    focusCancel: true,
  });

  return result.isConfirmed;
};

export const showErrorDialog = async ({
  title = 'حدث خطأ',
  text,
  html,
  confirmButtonText = 'حسناً',
}) =>
  Swal.fire({
    ...buildBaseOptions(),
    title,
    text,
    html,
    icon: 'error',
    confirmButtonText,
  });

export const showSuccessToast = async ({
  title,
  text,
  timer = 2200,
}) =>
  Swal.fire({
    ...buildBaseOptions(),
    title,
    text,
    icon: 'success',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
  });
