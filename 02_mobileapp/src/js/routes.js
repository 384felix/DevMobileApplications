import SudokuPage from '../pages/sudoku.jsx';
import SudokuMenuPage from '../pages/sudoku-menu.jsx';
import SudokuListPage from '../pages/sudoku-list.jsx';
import StartPage from '../pages/start.jsx';
import FriendsPage from '../pages/friends.jsx';
import ProfilePage from '../pages/profile.jsx';
import NotFoundPage from '../pages/404.jsx';
import LeaderboardPage from '../pages/leaderboard.jsx';

var routes = [
  { path: '/', redirect: '/start/' },
  { path: '/start/', component: StartPage },

  { path: '/sudoku/', component: SudokuPage },
  { path: '/sudoku-menu/', component: SudokuMenuPage },
  { path: '/sudoku-list/', component: SudokuListPage },
  { path: '/friends/', component: FriendsPage },
  { path: '/leaderboard/', component: LeaderboardPage },

  { path: '/profile/', component: ProfilePage },
  { path: '/login/', redirect: '/profile/' },

  { path: '(.*)', component: NotFoundPage },


];

export default routes;
