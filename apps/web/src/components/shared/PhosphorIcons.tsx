import type { SVGProps } from 'react'

export type PhosphorIconName =
  | 'arrowLeft'
  | 'arrowClockwise'
  | 'check'
  | 'download'
  | 'floppyDisk'
  | 'gear'
  | 'listChecks'
  | 'magnifyingGlass'
  | 'pencilSimple'
  | 'plus'
  | 'printer'
  | 'signOut'
  | 'trash'
  | 'uploadSimple'
  | 'userPlus'
  | 'users'
  | 'x'

const paths: Record<PhosphorIconName, JSX.Element> = {
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowClockwise: <path d="M19.5 9A8 8 0 1 0 21 14m0-5h-5m5 0V4" />,
  check: <path d="m5 13 4 4L19 7" />,
  download: <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />,
  floppyDisk: <path d="M5 3h11l3 3v15H5V3Zm4 0v6h6V3M8 21v-7h8v7" />,
  gear: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4c0-.7-.1-1.4-.3-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15.2 2H8.8L8.4 5a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 0 4l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h6.4l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.2-.6.3-1.3.3-2Z" />,
  listChecks: <path d="m4 7 2 2 4-4M13 7h7M4 17l2 2 4-4m3 2h7" />,
  magnifyingGlass: <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21" />,
  pencilSimple: <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm11-13 3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  printer: <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-3a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z" />,
  signOut: <path d="M10 4H5v16h5m4-4 4-4-4-4m4 4H9" />,
  trash: <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  uploadSimple: <path d="M12 15V3m0 0 5 5m-5-5-5 5M5 21h14" />,
  userPlus: <path d="M15 19a6 6 0 0 0-12 0m6-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 1v6m3-3h-6" />,
  users: <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6 8a6 6 0 0 0-12 0m14-8a3 3 0 1 0 0-6m4 14a5 5 0 0 0-5-5" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

interface Props extends SVGProps<SVGSVGElement> {
  name: PhosphorIconName
  size?: number
}

export function PhosphorIcon({ name, size = 20, className = '', ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
