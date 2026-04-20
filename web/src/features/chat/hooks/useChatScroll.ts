import { useEffect, useRef, useState } from 'react'

type UseChatScrollOptions = {
  contentVersion: string
  isStreaming: boolean
  sessionId?: string
}

export function useChatScroll({
  contentVersion,
  isStreaming,
  sessionId,
}: UseChatScrollOptions) {
  const [composerDockHeight, setComposerDockHeight] = useState(220)
  const [followLatest, setFollowLatest] = useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const chatScrollRegionRef = useRef<HTMLDivElement>(null)
  const composerDockRef = useRef<HTMLDivElement>(null)

  function scrollToLatest(behavior: ScrollBehavior = 'smooth') {
    const scrollRegion = chatScrollRegionRef.current
    if (!scrollRegion) {
      return
    }
    setFollowLatest(true)
    setShowJumpToLatest(false)
    scrollRegion.scrollTo({
      top: scrollRegion.scrollHeight,
      behavior,
    })
    if (behavior === 'smooth') {
      window.setTimeout(() => {
        scrollRegion.scrollTo({
          top: scrollRegion.scrollHeight,
          behavior: 'auto',
        })
      }, 260)
    }
  }

  useEffect(() => {
    const dockElement = composerDockRef.current
    if (!dockElement) {
      return undefined
    }

    const updateDockHeight = () => {
      setComposerDockHeight(Math.ceil(dockElement.getBoundingClientRect().height))
    }

    updateDockHeight()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      updateDockHeight()
    })
    observer.observe(dockElement)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const scrollRegion = chatScrollRegionRef.current
    if (!scrollRegion) {
      return undefined
    }

    const syncScrollState = () => {
      const distanceToBottom = scrollRegion.scrollHeight - scrollRegion.clientHeight - scrollRegion.scrollTop
      const nearBottom = distanceToBottom <= 96
      setFollowLatest(nearBottom)
      setShowJumpToLatest(!nearBottom)
    }

    syncScrollState()
    scrollRegion.addEventListener('scroll', syncScrollState, { passive: true })
    return () => scrollRegion.removeEventListener('scroll', syncScrollState)
  }, [sessionId])

  useEffect(() => {
    const scrollRegion = chatScrollRegionRef.current
    if (!scrollRegion) {
      return
    }

    if (!followLatest && !isStreaming) {
      return
    }

    const scrollBehavior: ScrollBehavior = isStreaming ? 'auto' : 'smooth'
    window.requestAnimationFrame(() => {
      scrollToLatest(scrollBehavior)
    })
  }, [contentVersion, followLatest, isStreaming])

  useEffect(() => {
    if (!followLatest) {
      return
    }
    window.requestAnimationFrame(() => {
      scrollToLatest('auto')
    })
  }, [composerDockHeight, followLatest])

  return {
    chatScrollRegionRef,
    composerDockHeight,
    composerDockRef,
    followLatest,
    scrollToLatest,
    setFollowLatest,
    setShowJumpToLatest,
    showJumpToLatest,
  }
}
