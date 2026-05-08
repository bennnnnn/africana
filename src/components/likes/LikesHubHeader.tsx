import React from 'react';
import { View } from 'react-native';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { likesScreenStyles as s } from '@/components/likes/likes-screen-styles';

type Props = { title: string };

/**
 * Re-renders only when `title` changes (tab label), not when list/count state
 * updates elsewhere in the hub.
 */
export const LikesHubHeader = React.memo(
  function LikesHubHeader({ title }: Props) {
    return (
      <View style={s.header} collapsable={false}>
        <ScreenTitle>{title}</ScreenTitle>
      </View>
    );
  },
  (a, b) => a.title === b.title,
);
