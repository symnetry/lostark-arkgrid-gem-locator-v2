import { LostArkOpenAPI } from '.';

interface SecurityData {
  jwt: string;
}
export const apiClient = new LostArkOpenAPI.Api<SecurityData>({
  securityWorker: (securityData) => {
    if (!securityData) return {};
    return {
      headers: {
        Authorization: `Bearer ${securityData.jwt}`,
      },
    };
  },
});
