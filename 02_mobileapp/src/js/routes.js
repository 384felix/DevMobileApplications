import SudokuPage from '../pages/sudoku.jsx';
import FriendsPage from '../pages/friends.jsx';
import ProfilePage from '../pages/profile.jsx';
import NotFoundPage from '../pages/404.jsx';
import LeaderboardPage from '../pages/leaderboard.jsx';

var routes = [
  { path: '/', redirect: '/sudoku/' },

  { path: '/sudoku/', component: SudokuPage },
  { path: '/friends/', component: FriendsPage },
  { path: '/leaderboard/', component: LeaderboardPage },

  { path: '/profile/', component: ProfilePage },
  { path: '/login/', redirect: '/profile/' },

  { path: '(.*)', component: NotFoundPage },


];

export default routes;
