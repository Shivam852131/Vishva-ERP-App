import {
  CommonActions,
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import { navigationRef } from '@/src/navigation/navigation-ref';

type Params = Record<string, string | number | boolean | undefined>;

const ROOT_GROUPS: Record<string, string> = {
  '/(student)/dashboard': '/(student)',
  '/(student)/timetable': '/(student)',
  '/(student)/assignments': '/(student)',
  '/(student)/ai': '/(student)',
  '/(student)/profile': '/(student)',
  '/(faculty)/dashboard': '/(faculty)',
  '/(faculty)/classes': '/(faculty)',
  '/(faculty)/assignments': '/(faculty)',
  '/(faculty)/ai': '/(faculty)',
  '/(faculty)/profile': '/(faculty)',
  '/(parent)/dashboard': '/(parent)',
  '/(parent)/attendance': '/(parent)',
  '/(parent)/fees': '/(parent)',
  '/(parent)/ai': '/(parent)',
  '/(parent)/profile': '/(parent)',
  '/(college_admin)/dashboard': '/(college_admin)',
  '/(college_admin)/users': '/(college_admin)',
  '/(college_admin)/attendance': '/(college_admin)',
  '/(college_admin)/academics': '/(college_admin)',
  '/(college_admin)/reports': '/(college_admin)',
  '/(college_admin)/profile': '/(college_admin)',
  '/(college_admin)/career-hub': '/(college_admin)',
  '/(college_admin)/placements': '/(college_admin)',
  '/(college_admin)/assessments-admin': '/(college_admin)',
  '/(college_admin)/mentorship-admin': '/(college_admin)',
  '/(college_admin)/skill-admin': '/(college_admin)',
  '/(college_admin)/hostel-admin': '/(college_admin)',
  '/(college_admin)/payments': '/(college_admin)',
  '/(college_admin)/payment-settings': '/(college_admin)',
  '/(college_admin)/subscription': '/(college_admin)',
  '/(super_admin)/dashboard': '/(super_admin)',
  '/(super_admin)/colleges': '/(super_admin)',
  '/(super_admin)/users': '/(super_admin)',
  '/(super_admin)/reports': '/(super_admin)',
  '/(super_admin)/profile': '/(super_admin)',
};

function parsePath(path: string) {
  const [pathname, queryString] = path.split('?');
  const params: Params = {};

  if (queryString) {
    const search = new URLSearchParams(queryString);
    search.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { pathname, params };
}

function navigateTo(path: string, replace = false) {
  if (!navigationRef.isReady()) {
    return;
  }

  const { pathname, params } = parsePath(path);
  const group = ROOT_GROUPS[pathname];

  if (group) {
    navigationRef.dispatch(
      replace
        ? StackActions.replace(group, { screen: pathname, params })
        : CommonActions.navigate(group, { screen: pathname, params }),
    );
    return;
  }

  navigationRef.dispatch(
    replace
      ? StackActions.replace(pathname, params)
      : CommonActions.navigate(pathname, params),
  );
}

export const router = {
  push(path: string) {
    navigateTo(path, false);
  },
  replace(path: string) {
    navigateTo(path, true);
  },
  back() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  },
};

export function useRouter() {
  const navigation = useNavigation();

  return {
    push(path: string) {
      navigateTo(path, false);
    },
    replace(path: string) {
      navigateTo(path, true);
    },
    back() {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
  };
}

export function useLocalSearchParams<T extends Params>() {
  const route = useRoute();
  return (route.params || {}) as T;
}
