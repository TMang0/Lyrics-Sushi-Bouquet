import { useEffect, useRef } from 'react'

const COLORS = ['#ff0043', '#14fc56', '#1e7fff', '#e60aff', '#ffbf36', '#ffffff']
const TAU = Math.PI * 2

const random = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[(Math.random() * list.length) | 0]

function Fireworks({ active }) {
  const hostRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const host = hostRef.current
    const trails = document.createElement('canvas')
    const main = document.createElement('canvas')
    host.append(trails, main)
    const trailsCtx = trails.getContext('2d')
    const mainCtx = main.getContext('2d')
    const isMobile = window.matchMedia('(max-width: 640px)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2)
    const gravity = 0.9
    const starDrag = 0.98
    const sparkDrag = 0.9

    let width = 0
    let height = 0
    const comets = []
    const stars = []
    const sparks = []
    const flashes = []
    let nextLaunchAt = 0
    let lastTime = performance.now()
    let frameId = 0

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = rect.width
      height = rect.height
      for (const canvas of [trails, main]) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }
    }

    const addStar = (list, x, y, color, angle, speed, life, offX = 0, offY = 0) => {
      list.push({
        x, y, prevX: x, prevY: y, color, life, fullLife: life,
        speedX: Math.sin(angle) * speed + offX,
        speedY: Math.cos(angle) * speed + offY,
        sparkTimer: random(0, 120), sparkFreq: 0, sparkColor: color,
      })
    }

    const burst = (x, y, color, spreadSize) => {
      const speed = spreadSize / 96
      const count = Math.max(24, ((spreadSize / 54) ** 2) * (isMobile ? 0.6 : 1))
      const radius = 0.5 * Math.sqrt(count / Math.PI)
      const circumference = TAU * radius
      const halfCirc = circumference / 2
      const glitter = Math.random() < 0.5
      const glitterColor = Math.random() < 0.5 ? '#ffbf36' : '#ffffff'
      const secondColor = Math.random() < 0.3 ? pick(COLORS.filter((c) => c !== color)) : null
      const starLife = 900 + spreadSize * 1.6

      for (let ring = 0; ring <= halfCirc; ring += 1) {
        const ringSize = Math.cos((ring / halfCirc) * Math.PI * 0.5)
        const partsPerRing = circumference * ringSize
        const angleInc = TAU / partsPerRing
        const angleOffset = Math.random() * angleInc
        for (let part = 0; part < partsPerRing; part += 1) {
          const angle = angleInc * part + angleOffset + Math.random() * angleInc * 0.33
          const life = starLife + Math.random() * starLife * 0.125
          addStar(stars, x, y, secondColor && Math.random() < 0.5 ? secondColor : color, angle, ringSize * speed, life, 0, -spreadSize / 1800)
          if (glitter) {
            const star = stars[stars.length - 1]
            star.sparkFreq = 400
            star.sparkColor = glitterColor
          }
        }
      }
      flashes.push({ x, y, radius: spreadSize / 4 })
    }

    const launch = () => {
      const spreadSize = isMobile ? random(220, 320) : random(280, 420)
      const x = random(0.18, 0.82) * width
      const burstY = height * random(0.14, 0.42)
      const distance = height - burstY
      const velocity = (distance * 0.04) ** 0.64
      const color = pick(COLORS)
      comets.push({
        x, y: height, prevX: x, prevY: height, color, spreadSize,
        speedX: random(-0.15, 0.15), speedY: -velocity,
        life: velocity * 400, spinAngle: Math.random() * TAU, spinRadius: random(0.32, 0.85),
        sparkTimer: 0,
      })
    }

    const tick = (now) => {
      const frameTime = Math.min(now - lastTime, 50)
      lastTime = now
      const speed = frameTime / 16.667
      const gAcc = (frameTime / 1000) * gravity

      if (now >= nextLaunchAt) {
        launch()
        if (Math.random() < 0.35) window.setTimeout(launch, random(80, 240))
        nextLaunchAt = now + random(900, 1700)
      }

      for (let i = comets.length - 1; i >= 0; i -= 1) {
        const comet = comets[i]
        comet.life -= frameTime
        comet.prevX = comet.x
        comet.prevY = comet.y
        comet.spinAngle += 0.8 * speed
        comet.x += comet.speedX * speed + Math.sin(comet.spinAngle) * comet.spinRadius * speed
        comet.y += comet.speedY * speed
        comet.speedX *= 1 - (1 - 0.992) * speed
        comet.speedY *= 1 - (1 - 0.992) * speed
        comet.speedY += gAcc
        comet.sparkTimer -= frameTime
        while (comet.sparkTimer < 0) {
          comet.sparkTimer += 32
          addStar(sparks, comet.x, comet.y, '#ffbf36', Math.random() * TAU, Math.random() * 0.4, 320 + Math.random() * 600)
        }
        if (comet.life <= 0 || comet.speedY >= -0.4) {
          comets.splice(i, 1)
          burst(comet.x, comet.y, comet.color, comet.spreadSize)
        }
      }

      const drag = 1 - (1 - starDrag) * speed
      for (let i = stars.length - 1; i >= 0; i -= 1) {
        const star = stars[i]
        star.life -= frameTime
        if (star.life <= 0) {
          stars.splice(i, 1)
          continue
        }
        const burnRate = Math.sqrt(star.life / star.fullLife)
        star.prevX = star.x
        star.prevY = star.y
        star.x += star.speedX * speed
        star.y += star.speedY * speed
        star.speedX *= drag
        star.speedY *= drag
        star.speedY += gAcc
        if (star.sparkFreq) {
          star.sparkTimer -= frameTime
          while (star.sparkTimer < 0) {
            star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * (1 - burnRate) * 4
            addStar(sparks, star.x, star.y, star.sparkColor, Math.random() * TAU, Math.random() * 0.3 * burnRate, 240 + Math.random() * 600)
          }
        }
      }

      const sDrag = 1 - (1 - sparkDrag) * speed
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i]
        spark.life -= frameTime
        if (spark.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        spark.prevX = spark.x
        spark.prevY = spark.y
        spark.x += spark.speedX * speed
        spark.y += spark.speedY * speed
        spark.speedX *= sDrag
        spark.speedY *= sDrag
        spark.speedY += gAcc
      }

      trailsCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      trailsCtx.globalCompositeOperation = 'destination-out'
      trailsCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.175 * speed, 1)})`
      trailsCtx.fillRect(0, 0, width, height)
      trailsCtx.globalCompositeOperation = 'source-over'
      mainCtx.clearRect(0, 0, width, height)

      while (flashes.length) {
        const flash = flashes.pop()
        const gradient = trailsCtx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.radius)
        gradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)')
        gradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)')
        gradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)')
        gradient.addColorStop(1, 'rgba(255, 120, 20, 0)')
        trailsCtx.fillStyle = gradient
        trailsCtx.fillRect(flash.x - flash.radius, flash.y - flash.radius, flash.radius * 2, flash.radius * 2)
      }

      trailsCtx.globalCompositeOperation = 'lighten'
      trailsCtx.lineCap = 'round'
      trailsCtx.lineWidth = 3
      mainCtx.strokeStyle = '#fff'
      mainCtx.lineWidth = 1
      mainCtx.beginPath()
      for (const color of COLORS) {
        trailsCtx.strokeStyle = color
        trailsCtx.beginPath()
        for (const item of comets) {
          if (item.color !== color) continue
          trailsCtx.moveTo(item.x, item.y)
          trailsCtx.lineTo(item.prevX, item.prevY)
        }
        for (const star of stars) {
          if (star.color !== color) continue
          trailsCtx.moveTo(star.x, star.y)
          trailsCtx.lineTo(star.prevX, star.prevY)
          mainCtx.moveTo(star.x, star.y)
          mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6)
        }
        trailsCtx.stroke()
      }
      mainCtx.stroke()

      trailsCtx.lineCap = 'butt'
      trailsCtx.lineWidth = 1
      for (const color of ['#ffbf36', '#ffffff']) {
        trailsCtx.strokeStyle = color
        trailsCtx.beginPath()
        for (const spark of sparks) {
          if (spark.color !== color) continue
          trailsCtx.moveTo(spark.x, spark.y)
          trailsCtx.lineTo(spark.prevX, spark.prevY)
        }
        trailsCtx.stroke()
      }

      frameId = window.requestAnimationFrame(tick)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
      trails.remove()
      main.remove()
    }
  }, [active])

  return <div className="fireworks-layer" ref={hostRef} aria-hidden="true" />
}

export default Fireworks
