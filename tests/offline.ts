export const noNetwork: typeof fetch = async () => {
  throw new Error('Network disabled in QA');
};
