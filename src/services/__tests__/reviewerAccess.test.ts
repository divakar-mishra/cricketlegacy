import { authorizeReviewerAccess } from '../reviewerAccess';
import { getSupabaseClient } from '../supabaseClient';
jest.mock('../supabaseClient', () => ({ getSupabaseClient: jest.fn() }));
const session = { user: { id: 'reviewer', is_anonymous: false }, access_token: 'session-one' };
const getSession = jest.fn();
const rpc = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (getSupabaseClient as jest.Mock).mockReturnValue({ auth: { getSession }, rpc });
  getSession.mockResolvedValue({ data: { session }, error: null });
  rpc.mockResolvedValue({ data: 'reviewer', error: null });
});
test('authorizes only a live matching server response', async () => {
  expect(await authorizeReviewerAccess()).toBe(true);
  expect(rpc).toHaveBeenCalledWith('authorize_reviewer_access');
});
test.each([null, false, 'someone-else', { user_id: 'reviewer' }])('denies malformed or unauthorized response %p', async (data) => {
  rpc.mockResolvedValue({ data, error: null });
  expect(await authorizeReviewerAccess()).toBe(false);
});
test('fails closed on network errors', async () => {
  rpc.mockRejectedValue(new Error('offline'));
  expect(await authorizeReviewerAccess()).toBe(false);
});
test('rejects logout or session replacement while awaiting authorization', async () => {
  getSession.mockResolvedValueOnce({ data: { session }, error: null });
  getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
  expect(await authorizeReviewerAccess()).toBe(false);
});
test('anonymous users cannot request access', async () => {
  getSession.mockResolvedValue({ data: { session: { ...session, user: { ...session.user, is_anonymous: true } } } });
  expect(await authorizeReviewerAccess()).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
