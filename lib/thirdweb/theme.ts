import {lightTheme} from 'thirdweb/react'

// Custom theme matching existing brand colors
export const pryvTheme = lightTheme({
  colors: {
    primaryButtonBg: '#87CEEE', // brand.blue.500
    primaryButtonText: '#000000',
    secondaryButtonBg: '#D0E7F9', // brand.blue.300
    secondaryButtonText: '#000000',
    borderColor: '#B8E3E8', // brand.blue.400
    separatorLine: '#E0F1FF', // brand.blue.200
    skeletonBg: '#F2F9FF', // brand.blue.100
    modalBg: '#F4F7FF', // brand.white
  },
})
